import { RequestDocumentExaminationCommand } from "../../../domain/model/commands/request-document-examination.command.js";
import { RequestExaminationResource } from "../resources/request-examination.resource.js";
import { ExaminationParamsAssembler } from "./examination-params.assembler.js";

/** Translates the request resource into its command (resource → VO). */
export class RequestExaminationCommandFromResourceAssembler {
  static toCommandFromResource(resource: RequestExaminationResource): RequestDocumentExaminationCommand {
    return new RequestDocumentExaminationCommand(
      ExaminationParamsAssembler.toPersonId(resource.personId),
      ExaminationParamsAssembler.toDocumentRef(resource.documentRef),
    );
  }
}
