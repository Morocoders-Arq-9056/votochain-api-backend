import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class DraftProposalResource {
  @IsString() communityId: string;
  @IsArray() @ArrayMinSize(2) options: string[];
}
