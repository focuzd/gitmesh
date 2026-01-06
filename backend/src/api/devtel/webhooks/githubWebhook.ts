import { Error400 } from '@gitmesh/common'
import crypto from 'crypto'

/**
 * POST /webhook/devtel/github/:workspaceId
 * @summary GitHub webhook handler for DevSpace
 * @tag DevSpace Webhooks
 * @public (signature validated)
 */
export default async (req, res) => {
    const { workspaceId } = req.params
    const signature = req.headers['x-hub-signature-256']
    const event = req.headers['x-github-event']
    const deliveryId = req.headers['x-github-delivery']

    req.log.info({ workspaceId, event, deliveryId }, 'Received GitHub webhook')

    // Get workspace and integration
    const workspace = await req.database.devtelWorkspaces.findByPk(workspaceId)
    if (!workspace) {
        req.log.error({ workspaceId }, 'Workspace not found for GitHub webhook')
        throw new Error400(req.language, 'devtel.webhook.workspaceNotFound')
    }

    req.log.info({ workspaceId, tenantId: workspace.tenantId }, 'Found workspace for webhook')

    const integration = await req.database.devtelIntegrations.findOne({
        where: {
            workspaceId,
            provider: 'github',
            status: 'active',
        },
    })

    if (!integration) {
        req.log.error({ workspaceId }, 'No active GitHub integration found for workspace')
        throw new Error400(req.language, 'devtel.webhook.integrationNotFound')
    }

    req.log.info({ integrationId: integration.id, workspaceId }, 'Found active GitHub integration')

    // Validate signature
    const webhookSecret = integration.credentials?.webhookSecret
    if (webhookSecret && signature) {
        req.log.info({ workspaceId, event }, 'Validating webhook signature')
        const payload = JSON.stringify(req.body)
        const expectedSignature = `sha256=${crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex')}`

        if (signature !== expectedSignature) {
            req.log.error({ workspaceId, event, deliveryId }, 'Webhook signature validation failed')
            // Log failed attempt
            await req.database.devtelGithubWebhookLogs.create({
                workspaceId,
                event,
                deliveryId,
                payload: req.body,
                status: 'signature_failed',
                processedAt: new Date(),
            })
            throw new Error400(req.language, 'devtel.webhook.invalidSignature')
        }
        req.log.info({ workspaceId, event }, 'Webhook signature validated successfully')
    } else {
        req.log.warn({ workspaceId, event, hasSecret: !!webhookSecret, hasSignature: !!signature },
            'Webhook signature validation skipped')
    }

    // Log the webhook
    req.log.info({ workspaceId, event, deliveryId }, 'Creating webhook log entry')
    const webhookLog = await req.database.devtelGithubWebhookLogs.create({
        workspaceId,
        event,
        deliveryId,
        payload: req.body,
        status: 'received',
        processedAt: new Date(),
    })

    // Process based on event type
    try {
        req.log.info({ workspaceId, event, deliveryId }, 'Processing webhook event')
        switch (event) {
            case 'issues':
                await handleIssuesEvent(req, workspace, integration, req.body)
                break
            case 'pull_request':
                await handlePullRequestEvent(req, workspace, integration, req.body)
                break
            case 'push':
                await handlePushEvent(req, workspace, integration, req.body)
                break
            default:
                req.log.info({ workspaceId, event }, 'Unhandled event type, skipping processing')
                break
        }

        await webhookLog.update({ status: 'processed' })
        req.log.info({ workspaceId, event, deliveryId }, 'Webhook processed successfully')
    } catch (error) {
        req.log.error({ error, workspaceId, event, deliveryId }, 'Error processing webhook')
        await webhookLog.update({
            status: 'error',
            error: error.message,
        })
        throw error
    }

    await req.responseHandler.success(req, res, { received: true })
}

async function handleIssuesEvent(req: any, workspace: any, integration: any, payload: any) {
    const { action, issue, repository } = payload

    req.log.info({
        workspaceId: workspace.id,
        action,
        issueNumber: issue.number,
        repository: repository.full_name
    }, 'Processing GitHub issues event')

    // Find external link to see if issue exists
    // Note: externalId is the GitHub Issue ID (integer), not the Issue Number
    const existingLink = await req.database.devtelExternalLinks.findOne({
        where: {
            externalId: issue.id.toString(),
            externalType: 'github_issue',
            linkableType: 'issue'
        }
    })

    if (existingLink) {
        // Update existing issue
        const devtelIssue = await req.database.devtelIssues.findByPk(existingLink.linkableId)
        if (devtelIssue) {
            const updates: any = { updatedById: integration.createdById } // Use integration creator as updater? or null

            if (action === 'closed') {
                updates.status = 'done'
            } else if (action === 'reopened') {
                updates.status = 'todo'
            } else if (action === 'edited') {
                updates.title = issue.title
                updates.description = issue.body || ''
            }

            if (Object.keys(updates).length > 0) {
                await devtelIssue.update(updates)
                req.log.info({ issueId: devtelIssue.id, updates }, 'Updated DevTel issue from GitHub event')
            }

            // Update metadata
            await existingLink.update({
                metadata: {
                    ...existingLink.metadata,
                    status: issue.state,
                    updatedAt: issue.updated_at
                },
                lastSyncedAt: new Date()
            })
        }
        return
    }

    if (action === 'opened') {
        const link = issue.html_url
        req.log.info({ issueUrl: link, issueTitle: issue.title }, 'GitHub issue opened')

        // Find project by matching repo name in settings
        // We load all projects in workspace to find the matching one
        const projects = await req.database.devtelProjects.findAll({
            where: {
                workspaceId: workspace.id,
                deletedAt: null
            }
        })

        const project = projects.find((p: any) => p.settings?.githubRepo === repository.full_name)

        if (!project) {
            req.log.warn({ repo: repository.full_name }, 'Skipping issue creation: No project linked to this repo')
            return
        }

        // Create DevTel Issue
        const newIssue = await req.database.devtelIssues.create({
            projectId: project.id,
            title: issue.title,
            description: issue.body || '',
            status: 'todo',
            priority: 'medium',
            createdById: null, // System created
            metadata: {
                source: 'github',
                githubNumber: issue.number,
                githubAuthor: issue.user?.login
            }
        })

        // Create External Link
        await req.database.devtelExternalLinks.create({
            linkableType: 'issue',
            linkableId: newIssue.id,
            externalType: 'github_issue',
            externalId: issue.id.toString(),
            url: link,
            metadata: {
                number: issue.number,
                repo: repository.full_name,
                author: issue.user?.login,
                status: issue.state,
                createdAt: issue.created_at
            },
            lastSyncedAt: new Date()
        })

        req.log.info({ issueId: newIssue.id }, 'Created DevTel issue from GitHub issue')
    } else {
        req.log.info({ action }, 'Unhandled issue action or issue not found')
    }
}

async function handlePullRequestEvent(req: any, workspace: any, integration: any, payload: any) {
    const { action, pull_request, repository } = payload

    req.log.info({
        workspaceId: workspace.id,
        action,
        prNumber: pull_request.number,
        repository: repository.full_name
    }, 'Processing GitHub pull request event')

    // Parse PR body and title for issue references
    const issueRefs = parseIssueReferences(pull_request.body || '', pull_request.title || '')

    if (issueRefs.length > 0) {
        req.log.info({ issueRefs, prNumber: pull_request.number }, 'Found issue references in PR')

        for (const issueKey of issueRefs) {
            let devtelIssue = null;
            
            // Strategy 1: Look for numeric reference (#123) which maps to a synced GitHub Issue
            const numericMatch = issueKey.match(/^#?(\d+)$/);
            if (numericMatch) {
                 const githubNumber = parseInt(numericMatch[1], 10);
                 const link = await req.database.devtelExternalLinks.findOne({
                     where: {
                         externalType: 'github_issue',
                         linkableType: 'issue',
                         metadata: {
                            number: githubNumber,
                            repo: repository.full_name
                         }
                     }
                 });
                 if (link) {
                     devtelIssue = await req.database.devtelIssues.findByPk(link.linkableId);
                 }
            }
            
            // Strategy 2: Look for PROJ-123 if explicit Project Key is used (Legacy/Native)
            if (!devtelIssue && issueKey.includes('-')) {
                 try {
                    devtelIssue = await req.database.devtelIssues.findOne({
                        include: [{
                            model: req.database.devtelProjects,
                            as: 'project',
                            where: { workspaceId: workspace.id },
                        }],
                        where: req.database.sequelize.where(
                            req.database.sequelize.fn('CONCAT',
                                req.database.sequelize.col('project.prefix'),
                                '-',
                                req.database.sequelize.col('devtelIssues.sequenceNumber')
                            ),
                            issueKey
                        ),
                    })
                 } catch (e) {
                     // Use loose finding if sequenceNumber is missing
                     req.log.warn({ error: e.message }, 'Failed to lookup issue by sequence key')
                 }
            }

            if (!devtelIssue) {
                req.log.warn({ issueKey }, 'DevTel issue not found for reference')
                continue
            }

            req.log.info({ issueId: devtelIssue.id, issueKey }, 'Linking PR to DevTel issue')

            // Create or update external link checking uniqueness by externalId (PR ID) AND linkableId
            // A PR can be linked to multiple issues, so we need one link per issue-pr pair?
            // "externalType": "github_pr"
            // Wait, if we use externalId=PR.number for uniqueness, we can only link PR to ONE issue?
            // externalId should be PR.id (unique across github) or PR.number (unique per repo).
            // Currently payload uses pull_request.number.toString().
            // If I link PR#1 to Issue A and Issue B, I need two records in devtelExternalLinks?
            // The table devtelExternalLinks: linkableId + externalType + externalId?
            // If externalId is PR ID, then (IssueA, PR1) and (IssueB, PR1) are different rows if linkableId is part of unique key?
            // Usually not. It's usually externalId is unique per external type.
            // But we want to link ONE PR to MULTIPLE Issues.
            // If devtelExternalLinks is a generic mapping, then (linkableId, externalId, externalType) should be unique tuple.
            
            // For now, let's assume we create a link.
            const [link, created] = await req.database.devtelExternalLinks.findOrCreate({
                where: {
                    linkableType: 'issue',
                    linkableId: devtelIssue.id,
                    externalType: 'github_pr',
                    externalId: pull_request.number.toString()
                },
                defaults: {
                    url: pull_request.html_url,
                    metadata: {
                        status: pull_request.state,
                        merged: pull_request.merged || false,
                        author: pull_request.user.login,
                        title: pull_request.title,
                        createdAt: pull_request.created_at,
                        updatedAt: pull_request.updated_at,
                        repository: repository.full_name,
                    },
                },
            })

            if (!created) {
                await link.update({
                    metadata: {
                        status: pull_request.state,
                        merged: pull_request.merged || false,
                        author: pull_request.user.login,
                        title: pull_request.title,
                        createdAt: pull_request.created_at,
                        updatedAt: pull_request.updated_at,
                        repository: repository.full_name,
                    },
                    lastSyncedAt: new Date(),
                })
            }

            // Auto-close issue when PR is merged
            if (action === 'closed' && pull_request.merged) {
                if (['in_progress', 'review', 'todo'].includes(devtelIssue.status)) {
                    req.log.info({ issueId: devtelIssue.id, prNumber: pull_request.number },
                        'Auto-closing issue due to merged PR')

                    await devtelIssue.update({ status: 'done' })

                    // Broadcast via Socket.IO
                    if (req.io) {
                        req.io.to(`workspace:${workspace.id}`).emit('issue:updated', {
                            id: devtelIssue.id,
                            status: 'done',
                            updatedAt: new Date(),
                        })
                    }
                }
            }
        }
    } else {
        req.log.info({ action, prNumber: pull_request.number }, 'No issue references found in PR')
    }
}

// Helper function to parse issue references from text
function parseIssueReferences(body: string, title: string): string[] {
    const text = `${title} ${body}`
    const refs = new Set<string>()

    // Match patterns like: #123, PROJ-123, fixes #123, closes PROJ-123
    const patterns = [
        /#([A-Z]+-\d+)/gi,           // #PROJ-123
        /([A-Z]+-\d+)/g,              // PROJ-123
        /#(\d+(?=\s|$|\.|,|;))/g,    // #123 (standalone number)
    ]

    patterns.forEach(pattern => {
        const matches = text.matchAll(pattern)
        for (const match of matches) {
            refs.add(match[1])
        }
    })

    return Array.from(refs)
}

async function handlePushEvent(req: any, workspace: any, integration: any, payload: any) {
    const { commits, ref, repository } = payload

    req.log.info({
        workspaceId: workspace.id,
        ref,
        commitCount: commits?.length || 0,
        repository: repository.full_name
    }, 'Processing GitHub push event')

    // Track commits for velocity/activity metrics
    if (commits && commits.length > 0) {
        req.log.info({
            commitCount: commits.length,
            firstCommit: commits[0]?.message,
            author: commits[0]?.author?.name
        }, 'Push contains commits')
        // TODO: Create activity entries for DevTel analytics
        // Track commit velocity, code changes, author activity
    }
}
