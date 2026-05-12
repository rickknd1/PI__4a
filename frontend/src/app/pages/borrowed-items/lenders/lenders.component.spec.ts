import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LendersComponent } from './lenders.component';

describe('LendersComponent', () => {
  let component: LendersComponent;
  let fixture: ComponentFixture<LendersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LendersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LendersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
