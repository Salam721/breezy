import { registerRootComponent } from 'expo';

// Must run in the global scope so the background task is defined at startup.
import './src/tasks/locationTask';
import App from './App';

registerRootComponent(App);
