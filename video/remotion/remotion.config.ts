/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// この環境では Remotion 同梱ブラウザの配布元（remotion.media）に届かないため、
// あらかじめ入っている Chrome Headless Shell を使う。
Config.setBrowserExecutable(
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
);
