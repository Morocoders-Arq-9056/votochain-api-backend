import { Community } from "../../../domain/model/aggregates/community.aggregate.js";
import { AdminResource } from "../resources/admin.resource.js";
import { CommunityResource } from "../resources/community.resource.js";
import { CommunityStandingResource } from "../resources/community-standing.resource.js";
import { PolicyAnswerResource } from "../resources/policy-answer.resource.js";

export class CommunityResourceFromEntityAssembler {
  static toResourceFromEntity(community: Community): CommunityResource {
    const answer = community.answerStanding();
    const policy = community.policy;
    return new CommunityResource(
      community.id.value,
      community.standing,
      community.settings.name,
      community.settings.domicile,
      community.settings.contact,
      policy ? { threshold: policy.threshold, basis: policy.basis, majorityRule: policy.majorityRule } : null,
      community.admins.map((a) => ({ personId: a.personId.value, entrustedAt: a.entrustedAt })),
      answer.acceptsMembers,
      answer.acceptsProposals,
    );
  }

  static toStandingResource(community: Community): CommunityStandingResource {
    const answer = community.answerStanding();
    return new CommunityStandingResource(answer.standing, answer.acceptsMembers, answer.acceptsProposals);
  }

  static toAdminResources(community: Community): AdminResource[] {
    return community.admins.map((a) => new AdminResource(a.personId.value, a.entrustedAt));
  }

  static toPolicyResource(community: Community): PolicyAnswerResource {
    const policy = community.answerPolicy();
    return new PolicyAnswerResource(policy.threshold, policy.basis, policy.majorityRule);
  }
}
