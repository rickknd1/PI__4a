import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllBorrowedComponent } from './all-borrowed.component';

describe('AllBorrowedComponent', () => {
  let component: AllBorrowedComponent;
  let fixture: ComponentFixture<AllBorrowedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllBorrowedComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllBorrowedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
