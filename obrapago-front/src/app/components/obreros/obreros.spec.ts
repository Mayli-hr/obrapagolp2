import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Obreros } from './obreros';

describe('Obreros', () => {
  let component: Obreros;
  let fixture: ComponentFixture<Obreros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Obreros],
    }).compileComponents();

    fixture = TestBed.createComponent(Obreros);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
