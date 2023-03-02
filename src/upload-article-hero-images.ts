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
  const data = await fetch(
    `${process.env.PROJECT_2_GRAPHCMS_UPLOAD_ASSET_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PROJECT_2_GRAPHCMS_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(assetRemoteURL)}`,
    }
  )
    .then((res) => res.json())
    .then((data: ICreatedAsset) => {
      console.log(`\n Successfully uploaded asset to CMS, see details:\n`, {
        assetID: data.id,
        imageHeroHeading: strippedFilename(data.filename),
        visualName: `Visual: ${strippedFilename(data.filename)}`,
      });
      return {
        assetID: data.id,
        imageHeroHeading: strippedFilename(data.filename),
        visualName: `Visual: ${strippedFilename(data.filename)}`,
      };
    })
    .catch((err) => console.log(err));

  if (!data) {
    throw Error("couldn't fetch the image");
  }
  return data;
};

uploadAssetToCMS("https://media.graphassets.com/vsEgQ4hXSCyQuKlpEin8");
