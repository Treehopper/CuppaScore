import { createMemoryRepos } from '@cuplog/services';
import { describeRepositoryContract } from './repositories';

describeRepositoryContract('memory', () => Object.assign(createMemoryRepos(), { atomic: false }));
