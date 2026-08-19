import { getFormKeyboardAction } from '@/components/form-keyboard-navigation';

describe('getFormKeyboardAction', () => {
  it('uses Next without blurring for each intermediate field', () => {
    expect(getFormKeyboardAction(0, 3)).toEqual({
      returnKeyType: 'next',
      submitBehavior: 'submit',
    });
    expect(getFormKeyboardAction(1, 3)).toEqual({
      returnKeyType: 'next',
      submitBehavior: 'submit',
    });
  });

  it('uses Done and blurs for the final field', () => {
    expect(getFormKeyboardAction(2, 3)).toEqual({
      returnKeyType: 'done',
      submitBehavior: 'blurAndSubmit',
    });
  });
});
