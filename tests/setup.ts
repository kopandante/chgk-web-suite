// Test setup - register happy-dom globals
import { GlobalRegistrator } from "@happy-dom/global-registrator";

let registered = false;

export function registerDom() {
  if (!registered) {
    GlobalRegistrator.register();
    registered = true;
  }
}
