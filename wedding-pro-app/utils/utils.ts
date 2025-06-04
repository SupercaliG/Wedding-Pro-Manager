import { redirect } from "next/navigation";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @param {('org' | 'employee')} [formType] - Optional: the type of form originating the redirect.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
  formType?: "org" | "employee"
) {
  let queryString = `${type}=${encodeURIComponent(message)}`;
  if (formType) {
    queryString += `&type=${formType}`;
  }
  return redirect(`${path}?${queryString}`);
}
