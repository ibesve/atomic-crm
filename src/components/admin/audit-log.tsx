/**
 * ra-audit-log: Audit log / event timeline components.
 *
 * Re-exports timeline components and hooks from ra-audit-log.
 * These work with the "events" resource which is mapped via a DB view
 * from our audit_logs table.
 *
 * Example usage:
 *   import { RecordTimeline, EventList } from "@/components/admin/audit-log";
 *   // In a show view aside:
 *   <RecordTimeline resource="contacts" />
 *   // As a standalone page:
 *   <EventList />
 */

// Timeline components (record-specific event history)
export {
  RecordTimeline as EERecordTimeline,
  RecordTimelineItem,
  Timeline,
  TimelineGroup,
  TimelineItem,
  TimelineList,
  TimelinePlaceholder,
  TimelineSkeleton,
} from "@react-admin/ra-audit-log";

// Event list components (global event log)
export {
  EventList,
  EventDataTable,
  EventListFilter,
  EventFilterAside,
} from "@react-admin/ra-audit-log";

// Hooks
export {
  useTimelineGroup,
  groupByDay,
} from "@react-admin/ra-audit-log";
