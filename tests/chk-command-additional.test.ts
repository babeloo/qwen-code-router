/**
 * Additional tests for chk command to improve code coverage
 */

import { validateConfigurationWithApi } from '../src/commands/chk';
import { ConfigFile } from '../src/types';

// Sample configuration for testing
const sampleConfig: ConfigFile = {
  default_config: [{ name: 'openai-gpt4' }],
  configs: [{
    config: [
      { name: 'openai-gpt4', provider: 'openai', model: 'gpt-4' },
      { name: 'invalid-provider', provider: 'nonexistent', model: 'some-model' }
    ]
  }],
  providers: [
    {
      provider: 'openai',
      env: {
        api_key: 'test-openai-key',
        base_url: 'https://api.openai.com/v1',
        models: [
          { model: 'gpt-4' },
          { model: 'gpt-3.5-turbo' }
        ]
      }
    }
  ]
};

describe('validateConfigurationWithApi - Additional Tests', () => {
  // Mock fetch globally
  const mockFetch = jest.fn();
  global.fetch = mockFetch as any;

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return early when static validation fails', async () => {
    const result = await validateConfigurationWithApi('invalid-provider', sampleConfig, true);
    
    expect(result.configName).toBe('invalid-provider');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Provider 'nonexistent' not found in providers section");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle missing provider or config entry', async () => {
    // Create a config with missing provider
    const configWithMissingProvider: ConfigFile = {
      ...sampleConfig,
      providers: []
    };
    
    const result = await validateConfigurationWithApi('openai-gpt4', configWithMissingProvider, true);
    
    // Should return static validation result
    expect(result.isValid).toBe(false); // Static validation fails because provider is missing
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle API test with timeout error', async () => {
    // Mock timeout error
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'AbortError';
    mockFetch.mockRejectedValue(timeoutError);

    const result = await validateConfigurationWithApi('openai-gpt4', sampleConfig, true);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("API test timeout: Unable to connect to https://api.openai.com/v1");
  });

  it('should handle API test with general error', async () => {
    // Mock general error
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await validateConfigurationWithApi('openai-gpt4', sampleConfig, true);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("API test failed: Network error");
  });

  it('should handle API test with unknown error type', async () => {
    // Mock unknown error
    mockFetch.mockRejectedValue('Unknown error');

    const result = await validateConfigurationWithApi('openai-gpt4', sampleConfig, true);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("API test failed: Unknown error");
  });

  it('should handle API test with non-ok response status', async () => {
    // Mock failed API response
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as any);

    const result = await validateConfigurationWithApi('openai-gpt4', sampleConfig, true);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("API test failed: 500 Internal Server Error");
  });

  it('should handle API test with model not in response', async () => {
    // Mock successful API response but with different models
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-3.5-turbo' },
          { id: 'other-model' }
        ]
      })
    } as any);

    const result = await validateConfigurationWithApi('openai-gpt4', sampleConfig, true);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Model 'gpt-4' not available in API response");
  });

  it('should handle API test with invalid response data structure', async () => {
    // Mock successful API response but with invalid data structure
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        invalid: 'structure'
      })
    } as any);

    const result = await validateConfigurationWithApi('openai-gpt4', sampleConfig, true);
    
    expect(result.configName).toBe('openai-gpt4');
    expect(result.isValid).toBe(true); // Still valid because we couldn't verify the model
    expect(result.errors).toHaveLength(0);
  });
});