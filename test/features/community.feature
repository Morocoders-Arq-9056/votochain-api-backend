# language: en
@api @community
Feature: Community management
  As a community administrator
  I want to register and inspect a community
  So that its standing and configuration can be managed explicitly

  @register-community @smoke
  Scenario: Register a community with its founding administrator
    Given the API is configured with the prefix "api/v1"
    When I send a POST request to "/api/v1/communities" with:
      | name         | Villa El Salvador                   |
      | domicile     | Lima, Peru                          |
      | contact      | contact@villa.example               |
      | adminPersonId | per-3fa85f64-5717-4562-b3fc-2c963f66afa6 |
    Then the response status should be 201
    And the response should contain a community resource
    And the response should include a Location header for the created community

  @standing
  Scenario: Retrieve the standing of an existing community
    Given a community exists with identifier "com-00000000-0000-4000-8000-000000000001"
    When I send a GET request to "/api/v1/communities/com-00000000-0000-4000-8000-000000000001/standing"
    Then the response status should be 200
    And the response should contain the community standing
    And the response should indicate whether the community accepts members
