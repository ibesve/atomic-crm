/**
 * ra-tour: Guided tour wrapper using react-joyride via ra-tour's TourProvider.
 *
 * Re-exports TourProvider and useTour from ra-tour.
 * The actual UI rendering is handled by react-joyride which is framework-agnostic.
 */
export { TourProvider, useTour } from "@react-admin/ra-tour";
export type { TourType, StepType, StateType, DispatchStateType } from "@react-admin/ra-tour";
