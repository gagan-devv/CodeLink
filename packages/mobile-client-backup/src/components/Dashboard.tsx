import { ConnectionStatus } from '../websocket/WebSocketClient';

interface DashboardProps {
  status: ConnectionStatus;
  activeFile: string | null;
  lastSyncTime: Date | null;
  latency: number;
  onRefresh: () => void;
  onDisconnect: () => void;
  onSettings: () => void;
  onViewDiff: () => void;
  hasPayload: boolean;
}

function Dashboard({
  status,
  activeFile,
  lastSyncTime,
  latency,
  onRefresh,
  onDisconnect,
  onSettings,
  onViewDiff,
  hasPayload,
}: DashboardProps) {
  const getTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getBranchName = (): string => {
    // Extract branch from file path or use default
    return 'feature/auth-module';
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">CodeLink</h1>
        </div>
        <button
          onClick={onSettings}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* Connection Status Card */}
      <div
        className={`rounded-xl p-4 mb-4 ${
          status === 'connected'
            ? 'bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30'
            : status === 'connecting'
            ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30'
            : 'bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                status === 'connected'
                  ? 'bg-green-500'
                  : status === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {status === 'connected' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                )}
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-lg uppercase">
                {status === 'connected'
                  ? 'CONNECTED'
                  : status === 'connecting'
                  ? 'CONNECTING'
                  : 'DISCONNECTED'}
              </div>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-md text-xs font-semibold ${
              status === 'connected'
                ? 'bg-green-600 text-white'
                : status === 'connecting'
                ? 'bg-yellow-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {status === 'connected' ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* Active File Card */}
      <div className="bg-[#161b22] rounded-xl p-4 mb-4 border border-gray-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-gray-400 text-xs font-medium uppercase mb-1">
              ACTIVE FILE
            </div>
            <div
              className="text-blue-400 font-mono text-sm truncate cursor-pointer hover:text-blue-300 transition-colors"
              onClick={hasPayload ? onViewDiff : undefined}
            >
              {activeFile || 'No file selected'}
            </div>
          </div>
        </div>
      </div>

      {/* Last Synced Card */}
      <div className="bg-[#161b22] rounded-xl p-4 mb-4 border border-gray-800">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-gray-400 text-xs font-medium uppercase mb-1">
              LAST SYNCED
            </div>
            <div className="flex items-center justify-between">
              <div className="text-white font-medium">
                {lastSyncTime ? 'Successfully synced' : 'Not synced yet'}
              </div>
              <div className="text-gray-400 text-sm">{getTimeAgo(lastSyncTime)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-gray-400 text-xs font-medium uppercase">
            ENVIRONMENT INFO
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Latency Card */}
          <div className="bg-[#161b22] rounded-lg p-3 border border-gray-800">
            <div className="text-gray-400 text-xs uppercase mb-2">LATENCY</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="text-white font-bold text-lg">{latency}ms</div>
            </div>
          </div>

          {/* Branch Card */}
          <div className="bg-[#161b22] rounded-lg p-3 border border-gray-800">
            <div className="text-gray-400 text-xs uppercase mb-2">BRANCH</div>
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              <div className="text-white font-mono text-xs truncate">
                {getBranchName()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button
          onClick={onRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          REFRESH
        </button>
        <button
          onClick={onDisconnect}
          className="bg-[#161b22] hover:bg-[#1c2128] text-gray-300 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-gray-800 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          DISCONNECT
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
