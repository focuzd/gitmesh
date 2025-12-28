<template>
  <div class="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-6 relative overflow-y-auto selection:bg-orange-500/30">
    
    <div class="fixed inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>

    <div class="relative w-full max-w-sm z-10">
      
      <div class="mb-10 text-center flex flex-col items-center">
        <div class="relative group cursor-default mb-6">
          <div class="flex items-center justify-center gap-3">
            <div class="h-[1px] w-6 bg-zinc-800 group-hover:w-10 group-hover:bg-orange-500 transition-all duration-500"></div>
            <span class="text-white font-sans text-2xl font-black tracking-[0.2em] uppercase italic">
              Git<span class="text-orange-500">Mesh</span>
            </span>
            <div class="h-[1px] w-6 bg-zinc-800 group-hover:w-10 group-hover:bg-orange-500 transition-all duration-500"></div>
          </div>
        </div>

        <div class="inline-flex items-stretch border border-zinc-800 bg-zinc-950 shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden">
            <div class="px-2 py-1 bg-zinc-900 border-r border-zinc-800 flex items-center">
              <span class="text-zinc-500 font-mono text-[9px] uppercase tracking-tighter">System</span>
            </div>
            <div class="px-3 py-1.5 flex items-center gap-2">
                <span class="text-zinc-200 font-mono text-[10px] tracking-tight">root@gitmesh</span>
                <span class="text-zinc-600 font-mono text-[10px]">:</span>
                <span class="text-orange-500 font-mono text-[10px] font-bold">~/signup</span>
            </div>
        </div>
      </div>

      <el-form
        ref="form"
        :model="model"
        :rules="extendedRules"
        class="form space-y-3" 
        label-position="top"
        @submit.prevent="doSubmit"
      >
        <div class="grid grid-cols-2 gap-3">
          <el-form-item :prop="fields.firstName.name" class="!mb-0">
            <template #label>
              <span class="text-zinc-200 font-mono text-[10px] uppercase tracking-wider">Given_Name</span>
            </template>
            <el-input
              id="firstName"
              ref="focus"
              v-model="model[fields.firstName.name]"
              autocomplete="given-name"
              type="text"
              placeholder="VOID"
              class="terminal-input"
            />
            <template #error="{ error }">
              <div class="text-orange-500 text-[10px] font-mono mt-0.5 leading-none">> ERR: {{ error }}</div>
            </template>
          </el-form-item>

          <el-form-item :prop="fields.lastName.name" class="!mb-0">
            <template #label>
              <span class="text-zinc-200 font-mono text-[10px] uppercase tracking-wider">Family_Name</span>
            </template>
            <el-input
              id="lastName"
              v-model="model[fields.lastName.name]"
              autocomplete="family-name"
              type="text"
              placeholder="VOID"
              class="terminal-input"
            />
             <template #error="{ error }">
              <div class="text-orange-500 text-[10px] font-mono mt-0.5 leading-none">> ERR: {{ error }}</div>
            </template>
          </el-form-item>
        </div>

        <el-form-item :prop="fields.email.name" class="!mb-0">
          <template #label>
            <span class="text-zinc-200 font-mono text-[10px] uppercase tracking-wider">Primary_Email</span>
          </template>
          <el-input
            id="email"
            v-model="model[fields.email.name]"
            autocomplete="email"
            type="email"
            placeholder="USER@GITMESH.DEV"
            class="terminal-input"
          />
           <template #error="{ error }">
              <div class="text-orange-500 text-[10px] font-mono mt-0.5 leading-none">> ERR: {{ error }}</div>
            </template>
        </el-form-item>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <el-form-item :prop="fields.password.name" class="!mb-0">
            <template #label>
              <span class="text-zinc-200 font-mono text-[10px] uppercase tracking-wider">Access_Key</span>
            </template>
            <el-input
              id="password"
              v-model="model[fields.password.name]"
              autocomplete="new-password"
              :type="display.password ? 'text' : 'password'"
              class="terminal-input"
            >
              <template #suffix>
                <i 
                  class="cursor-pointer text-zinc-600 hover:text-orange-500 transition-colors text-xs"
                  :class="display.password ? 'ri-eye-line' : 'ri-eye-off-line'"
                  @click="display.password = !display.password"
                ></i>
              </template>
            </el-input>
             <template #error="{ error }">
              <div class="text-orange-500 text-[10px] font-mono mt-0.5 leading-tight">
                 > <span v-if="error === 'Password is invalid'">REJECTED</span>
                 <span v-else>ERR: {{ error }}</span>
              </div>
            </template>
          </el-form-item>

          <el-form-item :prop="fields.passwordConfirmation.name" class="!mb-0">
            <template #label>
              <span class="text-zinc-200 font-mono text-[10px] uppercase tracking-wider">Verify_Key</span>
            </template>
            <el-input
              id="passwordConfirmation"
              v-model="model[fields.passwordConfirmation.name]"
              autocomplete="new-password"
              :type="display.passwordConfirm ? 'text' : 'password'"
              class="terminal-input"
            >
              <template #suffix>
                <i 
                  class="cursor-pointer text-zinc-600 hover:text-orange-500 transition-colors text-xs"
                  :class="display.passwordConfirm ? 'ri-eye-line' : 'ri-eye-off-line'"
                  @click="display.passwordConfirm = !display.passwordConfirm"
                ></i>
              </template>
            </el-input>
             <template #error="{ error }">
              <div class="text-orange-500 text-[10px] font-mono mt-0.5 leading-none">> MISMATCH</div>
            </template>
          </el-form-item>
        </div>

        <div class="space-y-4 pt-4">
          <div class="flex flex-col gap-1">
            <el-checkbox
              v-model="model[fields.acceptedTermsAndPrivacy.name]"
              class="terminal-checkbox !h-auto"
            >
              <span class="text-zinc-400 text-[10px] font-mono leading-tight uppercase tracking-widest">
                Authorize <a href="/auth/terms" class="text-zinc-200 hover:text-orange-500 underline decoration-zinc-800">Directives</a> & <a href="/auth/privacy" class="text-zinc-200 hover:text-orange-500 underline decoration-zinc-800">Privacy_Link</a>
              </span>
            </el-checkbox>
            <div v-if="acceptTerms && !model[fields.acceptedTermsAndPrivacy.name]" class="text-orange-500 text-[10px] font-mono pl-6">
              > CRITICAL: AUTHORIZATION_REQUIRED
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="group w-full bg-orange-600 hover:bg-orange-500 text-black h-11 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] relative overflow-hidden"
          >
             <div class="absolute inset-0 w-full h-full bg-white/10 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            
            <span v-if="loading" class="animate-spin w-3 h-3 border-2 border-black border-t-transparent rounded-full"></span>
            <span v-else class="flex items-center gap-2 relative z-10">
               INITIALIZE_REGISTRATION
            </span>
          </button>
        </div>
      </el-form>

      <div class="relative py-8">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-zinc-900"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-black px-2 text-[9px] font-mono text-zinc-600 uppercase tracking-[0.3em]">Oauth_Gateway</span>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <a
          :href="socialOauthLink('github')"
          class="flex items-center justify-center gap-2 px-4 h-10 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-900/30 text-zinc-500 hover:text-orange-500 transition-all"
        >
          <i class="ri-github-fill text-lg" />
        </a>
        <a
          :href="socialOauthLink('google')"
          class="flex items-center justify-center gap-2 px-4 h-10 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-900/30 text-zinc-500 hover:text-orange-500 transition-all"
        >
          <i class="ri-google-fill text-lg" />
        </a>
      </div>

      <div class="text-center mt-8 flex items-center justify-center gap-6">
        <router-link :to="{ name: 'signin' }" class="text-zinc-500 hover:text-orange-500 text-[10px] font-mono transition-colors uppercase tracking-widest">
          // login_existing
        </router-link>
        <router-link :to="{ path: '/' }" class="text-zinc-500 hover:text-orange-500 text-[10px] font-mono transition-colors uppercase tracking-widest">
          // home
        </router-link>
      </div>

    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { UserModel } from '@/modules/user/user-model';
import config from '@/config';
import { passwordConfirmRules } from '@/modules/auth/auth-helpers';
import AppI18n from '@/shared/i18n/i18n.vue';

const { fields } = UserModel;

export default {
  name: 'AppSignupPage',
  components: { AppI18n },
  data() {
    return {
      rules: {
        firstName: fields.firstName.forFormRules(),
        lastName: fields.lastName.forFormRules(),
        email: fields.email.forFormRules(),
        password: fields.password.forFormRules(),
        passwordConfirmation: fields.passwordConfirmation.forFormRules(),
        acceptedTermsAndPrivacy: fields.passwordConfirmation.forFormRules(),
      },
      model: {},
      display: {
        password: false,
        passwordConfirm: false,
      },
      acceptTerms: false,
    };
  },

  computed: {
    ...mapGetters('auth', ['loading']),
    fields() { return fields; },
    extendedRules() {
      return passwordConfirmRules(this.rules, fields, this.model);
    },
  },

  methods: {
    ...mapActions('auth', ['doRegisterEmailAndPassword']),
    doSubmit() {
      this.acceptTerms = false;
      this.$refs.form.validate().then(() => {
        if (this.model.acceptedTermsAndPrivacy) {
          this.doRegisterEmailAndPassword({
            email: this.model.email,
            password: this.model.password,
            data: { firstName: this.model.firstName, lastName: this.model.lastName },
            acceptedTermsAndPrivacy: this.model.acceptedTermsAndPrivacy,
          });
        } else {
          this.acceptTerms = true;
        }
      });
    },
    socialOauthLink(provider) {
      return `${config.backendUrl}/auth/social/${provider}`;
    },
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;600;700;900&display=swap');

.font-sans { font-family: 'Inter', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  padding-bottom: 4px !important;
  line-height: 1.2 !important;
}

/* COMPACT INPUT STYLES */
:deep(.terminal-input .el-input__wrapper) {
  background-color: #09090b !important; /* zinc-950 */
  box-shadow: 0 0 0 1px #18181b !important; /* zinc-900 */
  border-radius: 0;
  padding: 0px 0px; 
  height: 42px; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.terminal-input .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #27272a !important; /* zinc-800 */
}

:deep(.terminal-input .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #ea580c !important; /* orange-600 */
  background-color: #000000 !important;
}

:deep(.terminal-input .el-input__inner) {
  color: #ffffff; 
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  height: 100%;
  padding-left: 12px;
}

:deep(.terminal-input .el-input__inner::placeholder) {
    color: #3f3f46; 
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.1em;
}

/* Checkbox Tweaks */
:deep(.terminal-checkbox .el-checkbox__inner) {
  background-color: transparent;
  border-color: #27272a;
  border-radius: 0;
  width: 12px; 
  height: 12px; 
}

:deep(.terminal-checkbox .el-checkbox__inner::after) {
  border-color: #000;
  top: 1px;
  left: 3px;
  width: 3px;
  height: 6px;
}

:deep(.terminal-checkbox .el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #ea580c; 
  border-color: #ea580c;
}

:deep(.terminal-checkbox .el-checkbox__label) {
  color: #52525b !important;
}
:deep(.terminal-checkbox .el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #ea580c !important;
}
</style>