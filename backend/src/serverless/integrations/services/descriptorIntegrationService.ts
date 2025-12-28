import { IIntegrationDescriptor } from '@gitmesh/integrations'
import { IntegrationServiceBase } from './integrationServiceBase'
import {
  IPendingStream,
  IStepContext,
  IIntegrationStream,
  IProcessStreamResults,
  IStreamResultOperation,
} from '../../../types/integration/stepResult'
import { IntegrationResultType, ICache } from '@gitmesh/types'
import { IGenerateStreamsContext, IProcessStreamContext } from '@gitmesh/integrations'
import { getServiceChildLogger } from '@gitmesh/logging'
import { RedisClient } from '@gitmesh/redis'
import { NANGO_CONFIG } from '../../../conf'
import IntegrationRepository from '../../../database/repositories/integrationRepository'

class RedisCache implements ICache {
  constructor(private readonly redis: RedisClient) {}
  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds)
    } else {
      await this.redis.set(key, value)
    }
  }
  async del(key: string): Promise<void> {
    await this.redis.del(key)
  }
}

class InMemoryCache implements ICache {
  private cache: Map<string, { value: string; expiry: number }> = new Map()

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key)
    if (!item) return null
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0
    this.cache.set(key, { value, expiry })
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key)
  }
}

export class DescriptorIntegrationService extends IntegrationServiceBase {
  private cache: ICache

  constructor(
    private readonly descriptor: IIntegrationDescriptor,
    redisClient?: RedisClient,
  ) {
    super(descriptor.type, descriptor.checkEvery || 60)
    if (redisClient) {
      this.cache = new RedisCache(redisClient)
    } else {
      this.cache = new InMemoryCache()
    }
  }

  private getServiceSettings() {
    return {
      nangoUrl: NANGO_CONFIG.url,
      nangoSecretKey: NANGO_CONFIG.secretKey,
    }
  }

  async getStreams(context: IStepContext): Promise<IPendingStream[]> {
    const streams: IPendingStream[] = []

    const ctx: IGenerateStreamsContext = {
      onboarding: context.onboarding,
      integration: context.integration,
      log: context.logger,
      cache: this.cache,
      serviceSettings: this.getServiceSettings(),
      publishStream: async (identifier, metadata) => {
        streams.push({
          value: identifier,
          metadata,
        })
      },
      updateIntegrationSettings: async (settings) => {
        await IntegrationRepository.update(
          context.integration.id,
          { settings },
          context.repoContext,
        )
      },
      updateIntegrationToken: async (token) => {
        await IntegrationRepository.update(context.integration.id, { token }, context.repoContext)
      },
      updateIntegrationRefreshToken: async (refreshToken) => {
        await IntegrationRepository.update(
          context.integration.id,
          { refreshToken },
          context.repoContext,
        )
      },
      abortRunWithError: async (message, metadata, error) => {
        context.logger.error({ metadata, err: error }, message)
        throw new Error(message)
      },
    }

    await this.descriptor.generateStreams(ctx)

    return streams
  }

  async processStream(
    stream: IIntegrationStream,
    context: IStepContext,
  ): Promise<IProcessStreamResults> {
    const operations: IStreamResultOperation[] = []
    const newStreams: IPendingStream[] = []

    const ctx: IProcessStreamContext = {
      onboarding: context.onboarding,
      integration: context.integration,
      log: context.logger,
      stream,
      cache: this.cache,
      globalCache: this.cache,
      integrationCache: this.cache,
      serviceSettings: this.getServiceSettings(),
      platformSettings: context.integration.settings,
      publishStream: async (identifier, metadata) => {
        newStreams.push({
          value: identifier,
          metadata,
        })
      },
      publishData: async (data) => {
        operations.push({
          type: IntegrationResultType.DATA,
          records: [data],
        })
      },
      updateIntegrationSettings: async (settings) => {
        await IntegrationRepository.update(
          context.integration.id,
          { settings },
          context.repoContext,
        )
      },
      updateIntegrationToken: async (token) => {
        await IntegrationRepository.update(context.integration.id, { token }, context.repoContext)
      },
      updateIntegrationRefreshToken: async (refreshToken) => {
        await IntegrationRepository.update(
          context.integration.id,
          { refreshToken },
          context.repoContext,
        )
      },
      abortWithError: async (message, metadata, error) => {
        context.logger.error({ metadata, err: error }, message)
        throw new Error(message)
      },
      setMessageVisibilityTimeout: async (newTimeout) => {
        // Not implemented
      },
      getDbConnection: () => {
        // Not implemented
        return null
      },
      getRateLimiter: (maxRequests, timeWindowSeconds, cacheKey) => {
        return {
          tryRemoveTokens: async (count) => 0,
        }
      },
      getConcurrentRequestLimiter: (maxConcurrentRequests, cacheKey) => {
        return {
          tryAcquire: async () => true,
          release: async () => {},
        }
      },
    }

    await this.descriptor.processStream(ctx)

    return {
      operations,
      newStreams,
    }
  }
}
