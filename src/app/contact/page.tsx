import type { Metadata } from "next";

import { ContactForm } from "@/components/ContactForm/ContactForm";

export const metadata: Metadata = {
  title: "문의하기 | GreenGreen",
  description: "GreenGreen 서비스에 의견을 남기는 문의 화면입니다.",
};

/** 문의하기 페이지를 렌더링한다. */
export default function ContactPage() {
  return <ContactForm />;
}
