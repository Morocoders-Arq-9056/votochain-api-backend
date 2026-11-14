# language: en
@api @sprint-1 @US-08 @community
Feature: Community management
  As a community administrator
  I want to register and inspect a community
  So that its standing and configuration can be managed explicitly

  @register-community @smoke
  Scenario: Register a community with its founding administrator
    Given the API is configured with the prefix "api/v1"
    When I send a POST request to "/api/v1/communities" with:
      | name         | ${BDD_COMMUNITY_NAME}               |
      | domicile     | Lima, Peru                          |
      | contact      | ${BDD_COMMUNITY_CONTACT}            |
      | adminPersonId | ${BDD_PERSON_ID}                     |
    Then the response status should be 201
    And the response should contain a community resource
    And the response should include a Location header for the created community

  @standing
  Scenario: Retrieve the standing of an existing community
    Given a community exists with identifier "${BDD_READY_COMMUNITY_ID}"
    When I send a GET request to "/api/v1/communities/${BDD_READY_COMMUNITY_ID}/standing"
    Then the response status should be 200
    And the response should contain the community standing
    And the response should indicate whether the community accepts members

  @activation
  Scenario: Activate a community with an administrator and a voting policy
    Given a registered community with an administrator and policy is available in the test environment
    When I send a PATCH request to "/api/v1/communities/${BDD_READY_COMMUNITY_ID}/standing" with:
      | standing | ACTIVE |
    Then the response status should be 200
    And the response should have standing "ACTIVE"

  @activation @validation
  Scenario: Reject activation when the community lacks a voting policy
    Given a registered community without a policy is available in the test environment
    When I send a PATCH request to "/api/v1/communities/${BDD_UNREADY_COMMUNITY_ID}/standing" with:
      | standing | ACTIVE |
    Then the response status should be 422
