import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPiRuntimeMcpEnv} from './runtime-mcp-env.ts';
test('empty native assignment masks inherited or configured transport',()=>{
 assert.deepEqual(buildPiRuntimeMcpEnv(undefined),{PAPERCLIP_PI_MCP_SERVERS_TOKEN_JSON:'[]'});
});
test('native assignment is projected without mutation or unrelated fields',()=>{
 const server={name:'assigned',url:'http://127.0.0.1:3110/api/mcp/gateways/fixture',token:'synthetic-run-token',connectionId:'assignment:fixture',extra:'unused'};
 const result=JSON.parse(buildPiRuntimeMcpEnv({getServers:()=>[server]}).PAPERCLIP_PI_MCP_SERVERS_TOKEN_JSON);
 assert.deepEqual(result,[{name:server.name,url:server.url,token:server.token,connectionId:server.connectionId}]);
 assert.equal(server.extra,'unused');
});
test('missing credentials and oversized runtime payloads fail without values in errors',()=>{
 assert.throws(()=>buildPiRuntimeMcpEnv({getServers:()=>[{name:'x'}]}),/Invalid Pi runtime/);
 const s={name:'x',url:'http://127.0.0.1:3110',token:'X'.repeat(66000),connectionId:'fixture'};
 assert.throws(()=>buildPiRuntimeMcpEnv({getServers:()=>[s]}),/exceeds bound/);
 assert.throws(()=>buildPiRuntimeMcpEnv({getServers:()=>Array(17).fill(s)}),/Too many/);
});
