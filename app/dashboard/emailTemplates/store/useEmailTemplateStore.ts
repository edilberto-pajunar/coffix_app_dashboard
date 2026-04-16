import { create } from "zustand";
import { EmailTemplate } from "../interface/emailTemplate";
import { EmailTemplateService } from "../service/EmailTemplateService";

interface EmailTemplateState {
  templates: EmailTemplate[];
  listenToTemplates: () => () => void;
}

export const useEmailTemplateStore = create<EmailTemplateState>((set) => ({
  templates: [],
  listenToTemplates: () =>
    EmailTemplateService.listenToTemplates((templates) => set({ templates })),
}));
