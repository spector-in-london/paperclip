import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAiConnectionCompatible as compatible} from '../src/ai-connections.ts';

for (const provider of ['anthropic','openai','openrouter','xai']) {
  test(`${provider}: Pi accepts API keys only for a qualified matching model`, () => {
    assert.equal(compatible({provider,method:'api_key'},'pi_local',provider+'/test-model'),true);
    assert.equal(compatible({provider,method:'api_key'},'pi_local','other/test-model'),false);
    for (const model of [undefined,null,42,'test-model',provider+'/'])
      assert.equal(compatible({provider,method:'api_key'},'pi_local',model),false);
    assert.equal(compatible({provider,method:'subscription'},'pi_local',provider+'/test-model'),false);
    assert.equal(compatible({provider,method:'subscription',mode:'shared',connectionId:'a',grantId:'b'},'pi_local',provider+'/test-model'),false);
    // Selection subsequently checks the saved account metadata, which must be api_key.
    assert.equal(compatible({provider,method:'subscription',mode:'responsible_user'},'pi_local',provider+'/test-model'),true);
  });
}
test('existing CLI subscription compatibility is preserved', () => {
  assert.equal(compatible({provider:'anthropic',method:'subscription'},'claude_local','claude-opus-5-5'),true);
  assert.equal(compatible({provider:'openai',method:'subscription'},'codex_local','gpt-6.1-sol'),true);
  assert.equal(compatible({provider:'openrouter',method:'api_key'},'opencode_local','anthropic/model'),false);
  assert.equal(compatible({provider:'anthropic',method:'api_key'},'paperclip_runner','model','acpx','claude'),true);
});
