import {getStore} from '@netlify/blobs';
import {createAPI} from '../../server/core.mjs';
export default createAPI({getStore}).session;
export const config={rateLimit:{windowLimit:15,windowSize:180,aggregateBy:['ip','domain']}};
