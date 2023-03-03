import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { strippedFilename } from "./utils.js";
dotenv.config();

export interface ICreatedAsset {
  filename: string;
  mimetype: string;
  size: number;
  width: number;
  height: number;
  url: string;
  id: string;
}
export const uploadAssetToCMS = async (
  assetRemoteURL: string
): Promise<{
  assetID: string;
  imageHeroHeading: string;
  visualName: string;
}> => {
  console.log("uploading asset", assetRemoteURL);
  const res = await fetch(
    `${process.env.PROJECT_2_GRAPHCMS_UPLOAD_ASSET_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PROJECT_2_GRAPHCMS_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(assetRemoteURL)}`,
    }
  );
  console.log("Uploaded result: ", res);
  if (!res.ok) {
    const message = await res.text();
    console.log(message);
    return;
  }
  const data = (await res.json()) as ICreatedAsset;

  // console.log(`\n Successfully uploaded asset to CMS, see details:\n`, {
  //   assetID: data.id,
  //   imageHeroHeading: strippedFilename(data.filename),
  //   visualName: `Visual: ${strippedFilename(data.filename)}`,
  // });

  return {
    assetID: data.id,
    imageHeroHeading: strippedFilename(data.filename),
    visualName: `Visual: ${strippedFilename(data.filename)}`,
  };
};
