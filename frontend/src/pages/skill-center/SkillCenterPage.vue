<template>
  <!-- class="skill-center-page" class="skill-center-page__content" -->
  <PageShell name="skill-center">
    <section class="view-panel skill-center-view">
      <section class="panel skill-library-panel">
        <div class="panel-head">
          <div>
            <h3>Skill 中心</h3>
            <p>系统 Skill 可复制为我的 Skill；自定义 Skill 支持表单模式和 Markdown 高级模式。</p>
          </div>
          <BaseButton variant="primary" type="button" @click="$emit('start-create-skill')">新建我的 Skill</BaseButton>
        </div>
        <div class="skill-list">
          <button
            v-for="skill in availableSkills"
            :key="skill.id"
            :class="{ active: skillEditor.activeId === skill.id }"
            type="button"
            @click="$emit('edit-skill', skill)"
          >
            <strong>{{ skill.name }}</strong>
            <span>{{ skill.category }} · {{ skill.source === 'system' ? '系统' : skill.status === 'pending-review' ? '待审核' : '我的' }}</span>
          </button>
        </div>
      </section>

      <section class="panel skill-editor-panel">
        <div class="panel-head">
          <div>
            <h3>Skill 编辑器</h3>
            <p>初级用户用表单，高级用户可切换 Markdown。</p>
          </div>
          <div class="actions">
            <BaseButton type="button" @click="$emit('toggle-skill-editor-mode')">
              {{ skillEditor.mode === 'form' ? '切到 Markdown' : '切到表单' }}
            </BaseButton>
            <BaseButton variant="primary" type="button" @click="$emit('save-skill-draft')">保存 Skill</BaseButton>
          </div>
        </div>

        <div v-if="skillEditor.draft && skillEditor.mode === 'form'" class="skill-editor-grid">
          <label>名称<BaseInput v-model="skillEditor.draft.name" /></label>
          <label>分类<select v-model="skillEditor.draft.category">
            <option value="需求理解">需求理解</option>
            <option value="用户研究">用户研究</option>
            <option value="产品方案">产品方案</option>
            <option value="交互设计">交互设计</option>
            <option value="交付验证">交付验证</option>
            <option value="自定义">自定义</option>
          </select></label>
          <label>可见范围<select v-model="skillEditor.draft.visibility">
            <option value="project">当前项目</option>
            <option value="global">所有项目</option>
          </select></label>
          <label class="wide">描述<BaseTextarea v-model="skillEditor.draft.description" /></label>
          <label>适用场景<BaseTextarea v-model="skillEditor.draft.applicableScenariosText" /></label>
          <label>需要输入<BaseTextarea v-model="skillEditor.draft.requiredInputsText" /></label>
          <label>知识库检索范围<BaseTextarea v-model="skillEditor.draft.knowledgeScopesText" /></label>
          <label>工作步骤<BaseTextarea v-model="skillEditor.draft.stepsText" /></label>
          <label>追问规则<BaseTextarea v-model="skillEditor.draft.followUpRulesText" /></label>
          <label class="wide">输出格式<BaseTextarea v-model="skillEditor.draft.outputFormat" /></label>
          <label class="wide">验收标准<BaseTextarea v-model="skillEditor.draft.qualityChecksText" /></label>
          <section class="skill-builder-section wide">
            <div class="section-title-row">
              <strong>运行表单字段</strong>
              <BaseButton type="button" @click="$emit('add-skill-input-field')">添加字段</BaseButton>
            </div>
            <div v-for="field in skillEditor.draft.inputFields" :key="field.id" class="skill-field-row">
              <BaseInput v-model="field.label" placeholder="字段名" />
              <select v-model="field.type">
                <option value="text">单行文本</option>
                <option value="textarea">多行文本</option>
                <option value="single-select">单选</option>
                <option value="multi-select">多选</option>
                <option value="number">数字</option>
                <option value="boolean">开关</option>
              </select>
              <label class="inline-check"><input v-model="field.required" type="checkbox" /> 必填</label>
              <BaseInput v-model="field.placeholder" placeholder="占位提示" />
              <BaseTextarea
                v-if="field.type === 'single-select' || field.type === 'multi-select'"
                :model-value="fieldOptionsText(field)"
                placeholder="选项，一行一个"
                @update:model-value="$emit('update-field-options', field, $event)"
              />
              <BaseButton type="button" @click="$emit('remove-skill-input-field', field.id)">删除</BaseButton>
            </div>
          </section>
          <section class="skill-builder-section wide">
            <strong>知识库范围</strong>
            <select v-model="skillEditor.draft.knowledgeScopeConfig.mode">
              <option value="current-project">当前项目</option>
              <option value="selected-projects">指定项目</option>
              <option value="selected-items">指定知识条目</option>
              <option value="all-projects">全部项目</option>
            </select>
            <div class="scope-chip-row">
              <label v-for="type in sourceTypes" :key="type">
                <input
                  type="checkbox"
                  :checked="skillEditor.draft.knowledgeScopeConfig.sourceTypes.includes(type)"
                  @change="$emit('toggle-scope-type', type)"
                />
                {{ type }}
              </label>
            </div>
            <select
              v-if="skillEditor.draft.knowledgeScopeConfig.mode === 'selected-projects'"
              v-model="skillEditor.draft.knowledgeScopeConfig.projectIds"
              multiple
            >
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ displayProjectName(project) }}
              </option>
            </select>
          </section>
        </div>

        <textarea
          v-if="skillEditor.draft && skillEditor.mode === 'markdown'"
          v-model="skillEditor.markdown"
          class="markdown-editor"
        ></textarea>

        <div class="skill-import-box">
          <strong>外部 Skill 导入</strong>
          <BaseInput v-model="skillImportForm.url" placeholder="GitHub 或网页链接，只会导入为待审核草稿" />
          <BaseTextarea v-model="skillImportForm.raw" placeholder="也可以粘贴 Markdown Skill 内容" />
          <BaseButton type="button" @click="$emit('import-skill-draft')">导入为草稿</BaseButton>
        </div>

        <div v-if="skillEditor.draft" class="validation-box">
          <strong>{{ skillValidation.ok ? '结构检查通过' : '结构需要补齐' }}</strong>
          <span v-if="skillValidation.missing.length">缺失：{{ skillValidation.missing.join('、') }}</span>
          <span v-for="warning in skillValidation.warnings" :key="warning">{{ warning }}</span>
        </div>
      </section>
    </section>
  </PageShell>
</template>

<script setup>
import { BaseButton, BaseInput, BaseTextarea } from '../../components/base'
import PageShell from '../../components/layout/PageShell.vue'

defineProps({
  availableSkills: { type: Array, default: () => [] },
  skillEditor: { type: Object, required: true },
  skillImportForm: { type: Object, required: true },
  skillValidation: { type: Object, required: true },
  projects: { type: Array, default: () => [] },
  displayProjectName: { type: Function, required: true },
  fieldOptionsText: { type: Function, required: true }
})

defineEmits([
  'start-create-skill',
  'edit-skill',
  'toggle-skill-editor-mode',
  'save-skill-draft',
  'add-skill-input-field',
  'remove-skill-input-field',
  'update-field-options',
  'toggle-scope-type',
  'import-skill-draft'
])

const sourceTypes = ['knowledge', 'requirements', 'competitors', 'assets']
</script>
