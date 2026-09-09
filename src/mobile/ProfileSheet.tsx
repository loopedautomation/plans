/**
 * Who you are on this phone, from the left: the account with its face, Sign
 * out, or the way in. The workspace server is named so a phone pointed at
 * the wrong one says so.
 */
import { Avatar } from "../Avatar";
import { colorFor, configured, serverUrl, type Account } from "../workspace";
import { Sheet } from "./Sheet";

type Props = {
  account: Account | null | undefined;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
};

export function ProfileSheet({ account, onSignIn, onSignOut, onClose }: Props) {
  return (
    <Sheet side="left" title="You" onClose={onClose} testid="profile">
      {account ? (
        <div className="mobile-profile">
          <Avatar who={{ name: account.name ?? account.login, color: colorFor(account.login), avatar: account.avatar }} size={56} />
          <b>{account.name ?? account.login}</b>
          <small>{account.login}</small>
          <small className="mobile-profile-server">{serverUrl()}</small>
          <button type="button" className="mobile-primary" onClick={onSignOut} data-testid="sign-out">
            Sign out
          </button>
        </div>
      ) : (
        <div className="mobile-profile">
          <p className="mobile-empty">
            A workspace is a folder of files, edited together and live.{" "}
            {configured() ? "Sign in to open yours." : "No workspace server is configured on this phone."}
          </p>
          {configured() && (
            <button type="button" className="mobile-primary" onClick={onSignIn} data-testid="sign-in">
              Sign in
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
