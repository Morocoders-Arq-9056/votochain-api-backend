# language: en
@api @sprint-1 @iam @authentication
Feature: User authentication
  As a VotoChain user
  I want to register and manage my session through the REST API
  So that access to the solution is controlled without exposing credentials

  @US-04 @sign-up @smoke
  Scenario: Register a user with a valid email and password
    Given the API is configured with the prefix "api/v1"
    When I send a POST request to "/api/v1/auth/sign-up" with:
      | email    | ${BDD_SIGNUP_EMAIL} |
      | password | S3gura-2026      |
    Then the response status should be 201
    And the response should contain a registered user resource
    And the response should not contain the password

  @US-04 @validation
  Scenario: Reject a sign-up password that does not satisfy the policy
    Given the API is configured with the prefix "api/v1"
    When I send a POST request to "/api/v1/auth/sign-up" with:
      | email    | invalid-password@votachain.dev |
      | password | short                          |
    Then the response status should be 400

  @US-04
  Scenario: Reject a duplicate contact address
    Given a registered user is available in the test environment
    When I send a POST request to "/api/v1/auth/sign-up" with:
      | email    | ${BDD_USER_EMAIL} |
      | password | S3gura-2026      |
    Then the response status should be 409

  @US-06 @sign-in
  Scenario: Open a session with valid local credentials
    Given a registered user with valid local credentials is available in the test environment
    When I send a POST request to "/api/v1/auth/sign-in" with:
      | email     | ${BDD_USER_EMAIL}    |
      | password  | ${BDD_USER_PASSWORD} |
      | proofKind | LOCAL                |
    Then the response status should be 200
    And the response should contain a registered user resource
    And the response should have session "SESSION_OPEN"

  @US-06 @sign-in
  Scenario: Replace an existing session after a second valid sign-in
    Given a registered user with valid local credentials is available in the test environment
    When I sign in twice with the configured local credentials
    Then both sign-in responses should have status 200
    And the response should have session "SESSION_OPEN"

  @US-06 @sign-in
  Scenario: Reject invalid local credentials without revealing account existence
    Given a registered user exists with email "${BDD_USER_EMAIL}"
    When I send a POST request to "/api/v1/auth/sign-in" with:
      | email      | ${BDD_USER_EMAIL} |
      | password   | Wrong-2026       |
      | proofKind  | LOCAL            |
    Then the response status should be 401
    And the response should describe invalid credentials

  @US-06 @sign-out
  Scenario: Close an open user session
    Given a registered user exists with email "${BDD_USER_EMAIL}"
    And the user has an open session
    When I send a POST request to "/api/v1/auth/sign-out" with:
      | email | ${BDD_USER_EMAIL} |
    Then the response status should be 204
