import { msg } from '@lingui/core/macro';

const visibilityText = {
  public: msg`Public`,
  local: msg`Local`,
  unlisted: msg`Quiet public`,
  private: msg`Followers`,
  direct: msg`Private mention`,
};

export default visibilityText;
