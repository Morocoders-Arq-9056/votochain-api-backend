# language: en
@api @sprint-1 @US-05 @verification
Feature: Email verification challenge
  A registered person can request and answer a single-use challenge.
  The test environment must provide an existing person and, for successful
  answers, the actual code issued by its configured delivery adapter.

  Scenario: Request an email verification challenge for a consenting person
    Given a consenting registered person is available in the test environment
    When I send a POST request to "/api/v1/challenges" with:
      | personId | ${BDD_PERSON_ID}  |
      | purpose  | email-verification |
    Then the response status should be 201
    And the response should have standing "OPEN"
    And the response should not contain an OTP code

  Scenario: Confirm a challenge using its valid code
    Given an open email-verification challenge is available in the test environment
    When I send a POST request to "/api/v1/challenges/${BDD_CHALLENGE_ID}/answers" with:
      | code | ${BDD_OTP_CODE} |
    Then the response status should be 200
    And the response should have standing "CONFIRMED"
    And the response should not contain an OTP code

  Scenario: Reject an incorrect challenge answer
    Given an open email-verification challenge is available in the test environment
    When I send a POST request to "/api/v1/challenges/${BDD_CHALLENGE_ID}/answers" with:
      | code | 000000 |
    Then the response status should be 409

  Scenario: Reject an expired challenge answer
    Given an expired challenge is available in the test environment
    When I send a POST request to "/api/v1/challenges/${BDD_EXPIRED_CHALLENGE_ID}/answers" with:
      | code | 000000 |
    Then the response status should be 410

  Scenario: Reject a challenge request when contact is not allowed
    Given a registered person who revoked contact consent is available in the test environment
    When I send a POST request to "/api/v1/challenges" with:
      | personId | ${BDD_NO_CONSENT_PERSON_ID} |
      | purpose  | email-verification         |
    Then the response status should be 422
