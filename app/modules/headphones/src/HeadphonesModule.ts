import { NativeModule, requireNativeModule } from 'expo';

declare class HeadphonesModule extends NativeModule<{}> {
  isConnected(): boolean;
  currentOutputs(): string[];
}

export default requireNativeModule<HeadphonesModule>('Headphones');
