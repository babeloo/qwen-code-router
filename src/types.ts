// Core data model interfaces for Qwen Code Router

export interface ModelEntry {
  model: string;
}

export interface ProviderEnv {
  api_key: string;
  base_url: string;
  models: ModelEntry[];
}

export interface Provider {
  provider: string;
  env: ProviderEnv;
}

export interface ConfigEntry {
  provider: string;
  model: string;
}

export interface Config {
  config_name: string;
  config: ConfigEntry[];
}

export interface DefaultConfig {
  config_name: string;
}

export interface ConfigFile {
  default_config?: DefaultConfig[];
  configs: Config[];
  providers: Provider[];
}