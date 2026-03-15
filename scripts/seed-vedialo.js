const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATE_ITEMS = [
  {
    name: '個人技術',
    children: [
      { name: 'ボールコントロール（トラップ）', description: 'ファーストタッチの質、各部位でのコントロール' },
      { name: 'ドリブル', description: '運ぶドリブル、仕掛けるドリブル、突破力' },
      { name: 'パス', description: 'ショートパス、ロングパス、スルーパスの精度と判断' },
      { name: 'シュート', description: 'シュート精度、シュート力、シュートレンジ' },
      { name: 'ヘディング', description: '攻守におけるヘディングの強さと精度' },
      { name: 'ボールキープ', description: '体を使ったボールの保持力' },
    ]
  },
  {
    name: '戦術理解',
    children: [
      { name: 'ポジショニング（攻撃）', description: 'スペースの認知、効果的な立ち位置' },
      { name: 'ポジショニング（守備）', description: 'マークの位置取り、カバーリングポジション' },
      { name: 'オフ・ザ・ボールの動き', description: 'ボールを持っていない時の動き出し、フリーランニング' },
      { name: '判断力（攻撃）', description: 'パス・ドリブル・シュートの選択判断' },
      { name: '判断力（守備）', description: 'プレス・カバー・インターセプトの判断' },
      { name: 'ゲーム理解', description: '試合の流れを読む力、状況に応じたプレー選択' },
    ]
  },
  {
    name: 'フィジカル',
    children: [
      { name: 'スピード', description: 'トップスピード、加速力' },
      { name: 'アジリティ', description: '方向転換の速さ、素早さ' },
      { name: 'スタミナ', description: '持久力、90分間走り続ける力' },
      { name: '筋力・フィジカルコンタクト', description: '体の強さ、競り合いの強さ' },
      { name: 'バランス', description: '体幹の安定性、接触時のバランス維持' },
      { name: '柔軟性', description: '体の柔らかさ、怪我予防に関わる柔軟性' },
    ]
  },
  {
    name: 'メンタル',
    children: [
      { name: '集中力', description: '試合中の集中持続力' },
      { name: '積極性', description: 'チャレンジする姿勢、逃げない心' },
      { name: '責任感', description: '自分の役割を全うする意識' },
      { name: 'コミュニケーション', description: '味方への声かけ、指示、コーチング' },
      { name: 'リーダーシップ', description: 'チームを引っ張る力、鼓舞する力' },
      { name: '向上心', description: '自主練習、課題に対する取り組み姿勢' },
    ]
  },
  {
    name: '守備',
    children: [
      { name: '1対1の守備', description: '対人守備の強さ、間合い' },
      { name: 'タックル', description: 'ボール奪取の技術とタイミング' },
      { name: 'インターセプト', description: 'パスカットの予測と実行' },
      { name: 'カバーリング', description: '味方のカバー、スライド' },
      { name: 'プレス', description: 'ボールへの寄せ、プレッシャーの強度' },
    ]
  },
  {
    name: 'GK技術',
    children: [
      { name: 'セービング', description: 'シュートストップ能力' },
      { name: 'キャッチング', description: 'ボールの確保力' },
      { name: 'ポジショニング', description: 'ゴール前のポジション取り' },
      { name: 'フィードキック', description: 'ゴールキック、パントキックの精度と飛距離' },
      { name: 'コーチング', description: 'DFラインへの指示、声の出し' },
      { name: '飛び出し', description: '1対1の対応、ハイボール処理' },
    ]
  },
];

async function main() {
  console.log('Creating VEDIALO CF template team...');

  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'VEDIALO System' }
    });
  }

  let templateTeam = await prisma.team.findFirst({
    where: { name: 'VEDIALO CF' }
  });

  if (!templateTeam) {
    templateTeam = await prisma.team.create({
      data: {
        id: 'team-vedialo-cf',
        organizationId: org.id,
        name: 'VEDIALO CF',
        description: '評価項目テンプレート（基準クラブ）。各チームはこのテンプレートから評価項目をインポートできます。'
      }
    });
    console.log('Created VEDIALO CF team:', templateTeam.id);
  } else {
    console.log('VEDIALO CF already exists:', templateTeam.id);
  }

  const existingItems = await prisma.evaluationItem.count({
    where: { teamId: templateTeam.id }
  });

  if (existingItems > 0) {
    console.log(`VEDIALO CF already has ${existingItems} items. Skipping item creation.`);
    return;
  }

  let sortOrder = 0;
  for (const category of TEMPLATE_ITEMS) {
    const cat = await prisma.evaluationItem.create({
      data: {
        teamId: templateTeam.id,
        name: category.name,
        sortOrder: sortOrder++,
        isActive: true,
        maxScore: 5
      }
    });
    console.log(`  Category: ${category.name} (${cat.id})`);

    for (const child of category.children) {
      await prisma.evaluationItem.create({
        data: {
          teamId: templateTeam.id,
          parentId: cat.id,
          name: child.name,
          description: child.description,
          sortOrder: sortOrder++,
          isActive: true,
          maxScore: 5
        }
      });
    }
  }

  const totalItems = await prisma.evaluationItem.count({
    where: { teamId: templateTeam.id }
  });
  console.log(`Done! Created ${totalItems} evaluation items for VEDIALO CF.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
