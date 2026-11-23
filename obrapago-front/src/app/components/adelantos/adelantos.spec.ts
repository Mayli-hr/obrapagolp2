import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Adelantos } from './adelantos';

describe('Adelantos', () => {
  let component: Adelantos;
  let fixture: ComponentFixture<Adelantos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adelantos],
    }).compileComponents();

    fixture = TestBed.createComponent(Adelantos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
