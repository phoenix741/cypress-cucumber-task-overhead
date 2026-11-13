import { Given, Then, When } from '@badeball/cypress-cucumber-preprocessor';

Given('I open the counter page', () => {
	cy.visit('app/index.html');
});

When('I click the increment button', () => {
	cy.get('[data-cy=increment]').click();
});

Then('the counter shows {int}', (expected: number) => {
	cy.get('[data-cy=counter]').should('have.text', String(expected));
});

When('I run a trivial step', () => {
	cy.wrap(null, { log: false });
});
