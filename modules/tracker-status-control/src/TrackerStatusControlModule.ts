import { NativeModule, requireNativeModule } from 'expo';

declare class TrackerStatusControlModule extends NativeModule<{}> {}

export default requireNativeModule<TrackerStatusControlModule>('TrackerStatusControl');
