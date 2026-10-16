import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { ConsentScopeValue } from "../../../domain/model/valueobjects/consent-scope.value-object.js";
import { ConsentStanding } from "../../../domain/model/valueobjects/consent-standings.value-object.js";

export class GrantConsentResource {
  @IsString()
  @IsNotEmpty()
  personId!: string;

  @IsString()
  @IsIn(Object.values(ConsentScopeValue))
  scope!: string;

  @IsString()
  @IsNotEmpty()
  policyVersion!: string;
}

export class RevokeConsentResource {
  @IsString()
  @IsNotEmpty()
  personId!: string;
}

export class ConsentStateResource {
  granted!: boolean;
  policyVersion!: string;
  since!: string | null;

  @IsString()
  @IsIn(Object.values(ConsentStanding))
  standing!: string;
}

export class SubmitErasureRequestResource {
  @IsString()
  @IsNotEmpty()
  personId!: string;
}

export class RecordRevocationConfirmationResource {
  @IsString()
  @IsNotEmpty()
  owner!: string;
}

export class DefineRetentionPolicyResource {
  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsObject()
  terms!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  supersedes?: string | null;
}
