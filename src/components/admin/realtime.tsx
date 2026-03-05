/**
 * ra-realtime: Real-time live update components.
 *
 * Re-exports the headless hooks and Supabase-specific builder from ra-realtime.
 * These components/hooks can be used to add live updates to any list or show view.
 *
 * Example usage:
 *   import { useListLiveUpdate } from "@/components/admin/realtime";
 *   // Inside a List component:
 *   useListLiveUpdate(); // Automatically refreshes when records change
 */

// Headless hooks for live updates
export {
  useListLiveUpdate,
  useShowLiveUpdate,
} from "@react-admin/ra-realtime";

// Lock management hooks
export {
  useLock,
  useGetLock,
  useGetLocks,
  useUnlock,
  useLockOnMount,
} from "@react-admin/ra-realtime";

// Builder for Supabase
export { addRealTimeMethodsBasedOnSupabase } from "@react-admin/ra-realtime";

// Types
export type {
  RealTimeDataProvider,
  Lock,
  Event as RealtimeEvent,
  SubscriptionCallback,
} from "@react-admin/ra-realtime";
