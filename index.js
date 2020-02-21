const faker = require("faker");
const { Client } = require("@elastic/elasticsearch");
const client = new Client({ node: "http://localhost:9200" });

function incr(counts, k) {
  if (counts[k]) {
    counts[k]++;
  } else {
    counts[k] = 1;
  }
}

function ciTotal(counts, k) {
  let x = 0;

  if (counts[k.toLocaleLowerCase()]) {
    x += counts[k.toLocaleLowerCase()];
  }
  if (counts[k.toLocaleUpperCase()]) {
    x += counts[k.toLocaleUpperCase()];
  }
}

const hits = response => response.body.hits.hits.map(x => x._source);

async function main() {
  let allKeywords = new Set();
  let keywordCounts = {};

  try {
    await client.indices.delete({ index: "lorem", ignore_unavailable: true });

    await client.indices.create({
      index: "lorem",
      body: {
        settings: {
          analysis: {
            normalizer: {
              lowercase_normalizer: {
                type: "custom",
                char_filter: [],
                filter: ["lowercase"],
              },
            },
          },
        },
        mappings: {
          properties: {
            text: { type: "text" },
            keywords: { type: "keyword", normalizer: "lowercase_normalizer" },
          },
        },
      },
    });

    for (let i = 0; i < 1000; i++) {
      let doc = {
        text: faker.lorem.paragraphs(3),
        keywords: faker.lorem.words(10).split(/\s+/),
      };

      doc.keywords = doc.keywords.map(k =>
        Math.random() > 0.5 ? k.toLocaleUpperCase() : k
      );

      doc.keywords.forEach(k => allKeywords.add(k));
      await client.create({ id: i, index: "lorem", body: doc });
    }

    let searchTerms = Array.from(allKeywords).slice(0, 10);

    searchTerms.forEach(async t => {
      let q1 = {
        query: {
          bool: { filter: { term: { keywords: t.toLocaleLowerCase() } } },
        },
      };

      let c1 = await client.count({ index: "lorem", body: q1 });
      let r1 = await client.search({ index: "lorem", body: q1 });

      let q2 = {
        query: {
          bool: { filter: { term: { keywords: t } } },
        },
      };

      let c2 = await client.count({ index: "lorem", body: q2 });
      let r2 = await client.search({ index: "lorem", body: q1 });

      console.log("TERM", t, c1.body.count, c2.body.count, hits(r1), hits(r2));
    });
    // console.log("ALL_KEYWORDS", Array.from(allKeywords).slice(0, 10));
  } catch (e) {
    console.error("ERROR", e);
  }
}

main();
