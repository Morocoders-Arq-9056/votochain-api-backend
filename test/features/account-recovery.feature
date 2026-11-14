# language: en
@api @sprint-1 @US-07 @iam
Feature: Recover access and update contact address
  An existing user may rotate a secret after proof and change contact email.

  Scenario: Request a password reset challenge by email
    Given a registered user is available in the test environment
    When I send a POST request to "/api/v1/challenges/by-email" with:
      | email   | ${BDD_USER_EMAIL} |
      | purpose | password-reset   |
    Then the response status should be 201
    And the response should have standing "OPEN"

  Scenario: Reset a secret after a confirmed recovery challenge
    Given a confirmed password-reset challenge is available in the test environment
    When I send a POST request to "/api/v1/challenges/${BDD_RESET_CHALLENGE_ID}/secret" with:
      | newSecret | ${BDD_NEW_SECRET} |
    Then the response status should be 200

  Scenario: Reject a reset without a confirmed recovery challenge
    Given an open password-reset challenge is available in the test environment
    When I send a POST request to "/api/v1/challenges/${BDD_OPEN_RESET_CHALLENGE_ID}/secret" with:
      | newSecret | ${BDD_NEW_SECRET} |
    Then the response status should be 404

  Scenario: Change the email of an existing user to an available address
    Given a registered user is available in the test environment
    When I send a PATCH request to "/api/v1/users/${BDD_USER_ID}/email" with:
      | newEmail | ${BDD_AVAILABLE_EMAIL} |
    Then the response status should be 200
    And the response should have standing "ACTIVE"
    And the response should have email "${BDD_AVAILABLE_EMAIL}"
    And the response should indicate the email is unverified
