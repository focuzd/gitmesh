const path = require('path');
const fs = require('fs');

module.exports = {
  repositoryFactory: () => {
    return {
      dataSchemaFiles: () => {
        // Schema files are in src/schema
        // When running in container with volume mount ../services/libs/cubejs:/cube/conf
        // __dirname will be /cube/conf (or potentially root in some envs)
        
        // Try multiple paths to be robust
        const paths = [
           path.join(__dirname, 'src', 'schema'),
           path.join(__dirname, 'schema'),
           path.join(process.cwd(), 'src', 'schema'),
           path.join(process.cwd(), 'schema')
        ];
        
        for (const schemaPath of paths) {
           try {
             if (fs.existsSync(schemaPath)) {
                const files = fs.readdirSync(schemaPath)
                  .filter(f => f.endsWith('.js'))
                  .map(f => ({
                      fileName: f,
                      content: fs.readFileSync(path.join(schemaPath, f), 'utf-8')
                  }));
                
                if (files.length > 0) {
                    return files;
                }
             }
           } catch (e) {
             console.error(`Error reading schema from ${schemaPath}:`, e);
           }
        }
        
        console.error("No schema files found in any candidate path!");
        return [];
      },
    };
  },
  queryRewrite: (query, { securityContext }) => {
    if (!securityContext.tenantId) {
      throw new Error('No id found in Security Context!');
    }
    
    // Default segments to empty array if not present
    const segments = securityContext.segments || [];

    if (!securityContext.segments && !segments) {
      throw new Error('No segments found in Security Context!')
    }

    const measureCube = query.measures[0].split('.');

    if (
      query.timeDimensions &&
      query.timeDimensions[0] &&
      !('granularity' in query.timeDimensions[0]) &&
      (!('dateRange' in query.timeDimensions[0]) ||
        ('dateRange' in query.timeDimensions[0] && query.timeDimensions[0].dateRange === undefined))
    ) {
      query.timeDimensions = [];
    }

    if (query.dimensions && query.dimensions[0] && query.dimensions[0] === 'Members.score') {
      query.filters.push({
        member: 'Members.score',
        operator: 'notEquals',
        values: ['-1'],
      });
    }

    if (
      query.measures[0] === 'Members.cumulativeCount' &&
      query.timeDimensions[0] &&
      !query.timeDimensions[0].dateRange
    ) {
      query.timeDimensions[0].dateRange = ['2020-01-01', new Date().toISOString()];
    }

    // Only add Members.isBot filter for Members cube queries
    if (measureCube[0] === 'Members') {
      query.filters.push({
        member: `Members.isBot`,
        operator: 'equals',
        values: ['0'],
      });
    }

    query.filters.push({
      member: `${measureCube[0]}.tenantId`,
      operator: 'equals',
      values: [securityContext.tenantId],
    });

    if (securityContext.segments && securityContext.segments.length > 0) {
      query.filters.push({
        member: 'Segments.id',
        operator: 'equals',
        values: securityContext.segments,
      });
    }

    return query;
  },
};
