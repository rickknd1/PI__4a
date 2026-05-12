import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstantVoiceComponent } from './instant-voice.component';

describe('InstantVoiceComponent', () => {
  let component: InstantVoiceComponent;
  let fixture: ComponentFixture<InstantVoiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstantVoiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstantVoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
