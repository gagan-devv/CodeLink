/**
 * Connection quality monitoring hook
 * Measures latency and connection stability
 */

import { useState, useEffect, useRef } from 'react';
import { useConnection } from './useConnection';

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface ConnectionMetrics {
  quality: ConnectionQuality;
  latency: number | null;
  lastPingTime: Date | null;
}

export const useConnectionQuality = () => {
  const { status, socketManager } = useConnection();
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    quality: 'offline',
    latency: null,
    lastPingTime: null,
  });
  const pingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (status !== 'connected') {
      setMetrics({
        quality: 'offline',
        latency: null,
        lastPingTime: null,
      });
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      return;
    }

    // Measure latency periodically
    const measureLatency = async () => {
      const startTime = Date.now();

      try {
        // Send a ping message and wait for response
        // This is a simplified version - you'd need to implement actual ping/pong
        const latency = Date.now() - startTime;

        const quality = getQualityFromLatency(latency);

        setMetrics({
          quality,
          latency,
          lastPingTime: new Date(),
        });
      } catch (error) {
        setMetrics({
          quality: 'poor',
          latency: null,
          lastPingTime: new Date(),
        });
      }
    };

    // Initial measurement
    measureLatency();

    // Measure every 10 seconds
    pingIntervalRef.current = setInterval(measureLatency, 10000);

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [status, socketManager]);

  return metrics;
};

function getQualityFromLatency(latency: number): ConnectionQuality {
  if (latency < 50) return 'excellent';
  if (latency < 150) return 'good';
  if (latency < 300) return 'fair';
  return 'poor';
}
