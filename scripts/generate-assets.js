const fs = require("fs");
const path = require("path");

const neverRandomizeToNone = ["Torso", "Head", "Hands", "Eyes", "Mouth", "Eyebrows"];

const assetOrder = [
  "Hair",
  "Head",
  "Eyes",
  "Eyebrows",
  "Mouth",
  "Facial Hair",
  "Hands",
  "Torso",
  "Torso Jacket",
  "Headwear",
  "Eyewear",
  "Earring",
  "Accessory",
];

const colors = [
  "black",
  "blonde",
  "blue",
  "dark brown",
  "light brown",
  "brown",
  "gray",
  "pink",
  "red",
  "white",
  "lavender",
  "mixed",
];

const categoryDescription = {
  Hair: {
    Type: {
      regExp: new RegExp(`hair_(.+)-(${colors.join("|")})$`),
      isPrimaryOption: true,
    },
    Color: {
      regExp: new RegExp(`-(${colors.join("|")})$`),
    }
  },
  Head: {
    Type: {
      regExp: /head_(.+)-skin/,
      isPrimaryOption: true,
    },
    "Skin Tone": {
      regExp: /skin-[0-9a-z]/,
    }
  },
  Eyes: {
    Style: {
      regExp: /style-[0-9a-z][0-9a-z]?/,
      isPrimaryOption: true,
    },
    Color: {
      regExp: /style-[0-9a-z][0-9a-z]?-(.+)/,
    }
  },
  Eyebrows: {
    Style: {
      regExp: /style-[0-9a-z]/,
      isPrimaryOption: true,
    },
    Color: {
      regExp: /style-[0-9a-z]-(.+)/,
    }
  },
  Mouth: {
    Type: {
      regExp: /mouth_(.+)-skin/,
      isPrimaryOption: true,
    },
    "Skin Tone": {
      regExp: /skin-[0-9a-z]/,
    }
  },
  "Facial Hair": {
    Type: {
      regExp: new RegExp(`facial-hair_(.+)-(${colors.join("|")})$`),
      isPrimaryOption: true,
    },
    Color: {
      regExp: new RegExp(`-(${colors.join("|")})$`),
    }
  },
  Torso: {
    Type: {
      regExp: /style-[0-9a-z]/,
      isPrimaryOption: true,
    },
    Outfit: {
      regExp: /style-[0-9a-z]-(.+)/,
    }
  },
  "Torso Jacket": {
    Type: {
      regExp: /style-[0-9a-z]/,
      isPrimaryOption: true,
    },
    Outfit: {
      regExp: /style-[0-9a-z]-(.+)/,
    }
  },
  Headwear: {
    Type: {
      regExp: new RegExp(`headwear_(.+)-(${colors.join("|")})?$`),
      isPrimaryOption: true,
    },
    Color: {
      regExp: new RegExp(`-(${colors.join("|")})?$`),
    }
  },
};

const customRandomizationWeights = {
  "Facial Hair": [
    {value: null, randomizationWeight: {useLength: true}}
  ],
  "Headwear": [
    {value: null, randomizationWeight: {value: 20}},
    {value: "headwear_spokemon-mixed", randomizationWeight: {value: 0.1}},
    {prefix: "headwear_hijab", randomizationWeight: {value: 0.05}}
  ],
  "Eyewear": [
    {value: null, randomizationWeight: {value: 20}}
  ],
  "Earring": [
    {value: null, randomizationWeight: {useLength: true}}
  ],
  "Accessory": [
    {value: "accessory_face-mask-1-animated", randomizationWeight: {value: 0.5}},
    {value: "accessory_pool-mask-1", randomizationWeight: {value: 0.1}},
  ],
  "Torso Jacket": [
    {value: null, randomizationWeight: {useLength: true}}
  ],
}

// TODO: This assumes option names and option values match in both categories. Maybe
// warn if that's not the case.
const matchRandomization = {
  "Torso Jacket": {
    categoryName: "Torso",
    primaryOption: "Type",
    secondaryOption: "Outfit"
  }
};

const matchRandomizationToNull = [
  "torso_style-1-bowling-shirt-1-red", 
  "torso_style-1-combat-vest-red", 
  "torso_style-1-sport-coat-1-dark", 
  "torso_style-1-sport-coat-1-gray", 
  "torso_style-1-ugly-christmas-1",
  "torso_style-1-waistcoat-and-cravat",
];

const categoriesToBisect = ["Hands", "Eyes", "Eyebrows"];
const partsToBisect = ["earring_hoop-large-both-gold", "earring_hoop-small-both-gold"];

const morphRelationships = {
  "headwear_hijab": [
    {
      targetCategoryName: "Head", 
      targetMorphName: "ear rotate back",
      targetMorphValue: 1
    }
  ]
};

function descriptionForPart({ category, filename }) {
  if (!categoryDescription[category]) return null;

  const template = categoryDescription[category];

  const description = {};
  for (const prop of Object.keys(template)) {
    const matches = filename.match(template[prop].regExp);
    if (!matches) {
      throw new Error(`Cannot generate description for part. "${filename}" does not match "${template[prop].regExp}".`);
    }
    description[prop] = matches.length > 1 ? matches[1] : matches[0];
  }
  return description;
}

function descriptionForCategory(categoryName, parts) {
  const description = {};

  for (const part of parts) {
    if (part.description) {
      for (const prop of Object.keys(part.description)) {
        description[prop] = description[prop] || {options: new Set()};
        description[prop].options.add(part.description[prop]);
      }
    }
  }

  for (const prop of Object.keys(description)) {
    description[prop].options = Array.from(description[prop].options);
    if (categoryDescription[categoryName][prop].isPrimaryOption) {
      description[prop].isPrimaryOption = true;
      description[prop].options.unshift(null);
    }
  }

  return description;
}

function generateAssetsStructure(directory) {
  const assetFileNames = fs.readdirSync(path.resolve(directory));

  const assets = {};

  for (const fullname of assetFileNames) {
    const filename = fullname.substring(0, fullname.lastIndexOf("."));

    let [hyphenatedCategory, hyphenatedName] = filename.split("_");
    category = hyphenatedCategory
      .split("-")
      .map((p) => capitalize(p))
      .join(" ");
    displayName = hyphenatedName
      .split("-")
      .map((p) => capitalize(p))
      .join(" ");

    if (!assets[category]) {
      assets[category] = {};
    }

    if (!assets[category].parts) {
      assets[category].parts = [
        {
          value: null,
          displayName: "None",
          excludeFromRandomize: neverRandomizeToNone.includes(category),
        },
      ];
    }

    const part = {
      value: filename,
      displayName,
    };
    const description = descriptionForPart({ category, filename });
    if (description) {
      part.description = description;
    }

    if (matchRandomizationToNull.includes(filename)) {
      part.matchRandomizationToNull = true;
    }

    if (partsToBisect.includes(filename)) {
      part.bisectInThumbnail = true;
    }

    for (prefix of Object.keys(morphRelationships)) {
      if (filename.startsWith(prefix)) {
        part.morphRelationships = morphRelationships[prefix];
      }
    }

    assets[category].parts.push(part);
  }

  for (const categoryName of Object.keys(assets)) {
    const description = descriptionForCategory(categoryName, assets[categoryName].parts);
    if (Object.keys(description).length) {
      assets[categoryName].description = description;
    }

    if (categoryName in matchRandomization) {
      assets[categoryName].matchRandomization = matchRandomization[categoryName];
    }

    if (categoriesToBisect.includes(categoryName)) {
      assets[categoryName].bisectInThumbnail = true;
    }
  }

  const orderedAssets = {};

  for (const category of assetOrder) {
    orderedAssets[category] = assets[category];
  }

  for (const [categoryName, configs] of Object.entries(customRandomizationWeights)) {
    for (const config of configs) {
      const category = orderedAssets[categoryName];
      const weight = config.randomizationWeight.useLength ? category.parts.length : config.randomizationWeight.value;
      const parts = category.parts.filter(part => (
        part.value === config.value || 
        part.value && part.value.startsWith(config.prefix)
      ));
      for (part of parts) {
        part.randomizationWeight = weight;
      }
    }
  }

  return orderedAssets;
}

const assets = generateAssetsStructure("./assets/models");
const result = `export default ${JSON.stringify(assets, null, 2)};`;

fs.writeFileSync("./src/assets.js", result);

function capitalize(str) {
  return str[0].toUpperCase() + str.substring(1);
}
