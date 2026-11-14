# language: en
@api @voting
Feature: Verifiable voting
  As an eligible voter
  I want to cast a vote with an idempotency key
  So that the resulting receipt can be verified without counting an unconfirmed intention

  @cast-vote @validation
  Scenario: Reject a vote request without an idempotency key
    Given a valid vote payload is available
    When I send a POST request to "/api/v1/votes" without the "Idempotency-Key" header
    Then the response status should be 400
    And the response should state that the idempotency key is required

  @cast-vote @smoke
  Scenario: Cast a vote with an idempotency key
    Given a valid authorization exists for proposal "prop-00000000-0000-4000-8000-000000000001"
    And the selected choice is "Option A"
    When I send a POST request to "/api/v1/votes" with header "Idempotency-Key" set to "vote-test-001"
    And the request body contains the authorization and selected choice
    Then the response status should be 201
    And the response should contain a voter receipt
    And the response should include a Location header for the created vote

  @receipt
  Scenario: Retrieve a vote receipt by proposal and voter
    Given a vote receipt exists for proposal "prop-00000000-0000-4000-8000-000000000001"
    And the voter address is "0x0000000000000000000000000000000000000001"
    When I send a GET request to "/api/v1/votes/receipt" with query parameters:
      | proposal | prop-00000000-0000-4000-8000-000000000001 |
      | voter    | 0x0000000000000000000000000000000000000001 |
    Then the response status should be 200
    And the response should contain the vote receipt standing
