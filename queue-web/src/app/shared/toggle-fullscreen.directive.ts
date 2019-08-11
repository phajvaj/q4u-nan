import { Directive, HostListener } from '@angular/core';
import * as screenfull from 'screenfull';

@Directive({
  selector: '[appToggleFullscreen]'
})
export class ToggleFullscreenDirective {

  fullscreen: boolean;

  constructor() { }

  @HostListener('click') onClick() {
    if (screenfull && screenfull.enabled) {
      screenfull.toggle();
    }
  }

}
