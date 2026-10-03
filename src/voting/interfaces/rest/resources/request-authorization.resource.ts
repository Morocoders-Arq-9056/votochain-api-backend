import { IsOptional, IsString } from "class-validator";

export class RequestAuthorizationResource {
  @IsString() proposalId: string;
  @IsString() voterAddress: string;
  @IsString() personId: string;
  @IsOptional() @IsString() walletHint?: string;
}
