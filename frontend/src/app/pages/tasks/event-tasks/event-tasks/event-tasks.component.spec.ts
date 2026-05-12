import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EventTasksComponent } from './event-tasks.component';

describe('EventTasksComponent', () => {
  let component: EventTasksComponent;
  let fixture: ComponentFixture<EventTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
