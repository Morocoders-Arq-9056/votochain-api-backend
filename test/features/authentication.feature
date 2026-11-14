# language: en
@api @iam @authentication
Feature: User authentication
  As a VotoChain user
  I want to register and manage my session through the REST API
  So that access to the solution is controlled without exposing credentials

  @sign-up @smoke
  Scenario: Register a user with a valid email and password
    Given the API is configured with the prefix "api/v1"
    When I send a POST request to "/api/v1/auth/sign-up" with:
      | email    | ada@votachain.dev |
      | password | S3gura-2026      |
    Then the response status should be 201
    And the response should contain a registered user resource
    And the response should not contain the password

  @validation
  Scenario: Reject a sign-up password that does not satisfy the policy
    Given the API is configured with the prefix "api/v1"
    When I send a POST request to "/api/v1/auth/sign-up" with:
      | email    | invalid-password@votachain.dev |
      | password | short                          |
    Then the response status should be 400

  @sign-in
  Scenario: Reject invalid local credentials without revealing account existence
    Given a registered user exists with email "ada@votachain.dev"
    When I send a POST request to "/api/v1/auth/sign-in" with:
      | email      | ada@votachain.dev |
      | password   | Wrong-2026       |
      | proofKind  | LOCAL            |
    Then the response status should be 401
    And the response should describe invalid credentials

  @sign-out
  Scenario: Close an open user session
    Given a registered user exists with email "ada@votachain.dev"
    And the user has an open session
    When I send a POST request to "/api/v1/auth/sign-out" with:
      | email | ada@votachain.dev |
    Then the response status should be 204
