import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../components/PageHeader';

export interface SettingsScreenProps {
  onNavigateDown?: () => void;
}

const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    return undefined as T;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

interface AppSettings {
  launch_on_startup: boolean;
  launch_fullscreen: boolean;
}

export function SettingsScreen({ onNavigateDown }: SettingsScreenProps) {
  const [settings, setSettings] = useState<AppSettings>({
    launch_on_startup: false,
    launch_fullscreen: false,
  });
  const [loading, setLoading] = useState(true);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await invokeCommand<AppSettings | null>('get_app_settings');
        if (saved) {
          setSettings(saved);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!loading) {
      firstOptionRef.current?.focus();
    }
  }, [loading]);

  useEffect(() => {
    const handleFocusSettings = () => firstOptionRef.current?.focus();
    window.addEventListener('focus-settings', handleFocusSettings);
    return () => window.removeEventListener('focus-settings', handleFocusSettings);
  }, []);

  const updateSetting = async (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await invokeCommand('save_app_settings', { settings: newSettings });
      if (key === 'launch_on_startup') {
        await invokeCommand('set_autolaunch', { enabled: value });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const options = document.querySelectorAll('[data-settings-option]');

    switch (e.key) {
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        if (currentIndex < options.length - 1) {
          (options[currentIndex + 1] as HTMLElement).focus();
        } else {
          onNavigateDown?.();
        }
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        if (currentIndex > 0) {
          (options[currentIndex - 1] as HTMLElement).focus();
        }
        break;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full p-lg pr-0">
        <PageHeader title="Settings" />
        <div className="flex items-center justify-center flex-1 text-text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-lg pr-0">
      <PageHeader title="Settings" />

      <div className="flex-1 overflow-y-auto pr-lg">
        <div className="mb-xl">
          <h3 className="text-sm font-semibold text-text-secondary m-0 mb-md uppercase tracking-wide">Startup</h3>

          <button
            ref={firstOptionRef}
            data-settings-option
            className="flex items-center justify-between w-full p-md mb-sm bg-surface border-none rounded cursor-pointer transition-colors duration-fast text-left hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            onClick={() => updateSetting('launch_on_startup', !settings.launch_on_startup)}
            onKeyDown={(e) => handleKeyDown(e, 0)}
          >
            <div className="flex flex-col gap-xs">
              <span className="text-base font-medium text-text-primary">Launch on computer start</span>
              <span className="text-[0.85rem] text-text-muted">
                Automatically start the launcher when you log in
              </span>
            </div>
            <div className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-fast shrink-0 ${settings.launch_on_startup ? 'bg-accent' : 'bg-tertiary'}`}>
              <div className={`w-6 h-6 bg-white rounded-full transition-transform duration-fast ${settings.launch_on_startup ? 'translate-x-5' : ''}`} />
            </div>
          </button>

          <button
            data-settings-option
            className="flex items-center justify-between w-full p-md mb-sm bg-surface border-none rounded cursor-pointer transition-colors duration-fast text-left hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            onClick={() => updateSetting('launch_fullscreen', !settings.launch_fullscreen)}
            onKeyDown={(e) => handleKeyDown(e, 1)}
          >
            <div className="flex flex-col gap-xs">
              <span className="text-base font-medium text-text-primary">Launch fullscreen</span>
              <span className="text-[0.85rem] text-text-muted">
                Start in fullscreen mode (toggle with Cmd+Ctrl+F or F11)
              </span>
            </div>
            <div className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-fast shrink-0 ${settings.launch_fullscreen ? 'bg-accent' : 'bg-tertiary'}`}>
              <div className={`w-6 h-6 bg-white rounded-full transition-transform duration-fast ${settings.launch_fullscreen ? 'translate-x-5' : ''}`} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
